// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';

type Policy = { tablename: string; permissive: string; cmd: string; qual: string | null; with_check: string | null };
const tables = ['deals', 'deal_products', 'crm_products', 'deal_installments', 'crm_leads', 'crm_organizations'];
function query(sql: string) {
  return JSON.parse(execFileSync('lovable', ['supabase', 'query', '--json', sql], { encoding: 'utf8', timeout: 30000 })).rows;
}
let policies: Policy[];
let results: Record<string, boolean | string>[];
beforeAll(() => {
  policies = query(`SELECT tablename, permissive, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename IN (${tables.map(t => `'${t}'`).join(',')})`);
  const expression = (value: string | null) => (value ?? 'true')
    .replaceAll("has_role(auth.uid(), 'admin'::app_role)", 'ctx.admin')
    .replaceAll('is_seller()', 'ctx.seller')
    .replaceAll('can_see_crm_account(crm_account)', 'ctx.allowed_account')
    .replace(/FROM deals d/g, 'FROM fixture_deals d');
  const rules = tables.map(table => {
    const applicable = policies.filter(p => p.tablename === table && ['ALL', 'SELECT'].includes(p.cmd));
    const permissive = applicable.filter(p => p.permissive === 'PERMISSIVE').map(p => `(${expression(p.qual)})`).join(' OR ') || 'false';
    const restrictive = applicable.filter(p => p.permissive === 'RESTRICTIVE').map(p => `(${expression(p.qual)})`).join(' AND ') || 'true';
    return `SELECT ctx.role_name, ctx.allowed_account, '${table}' AS table_name, deal_products.status, deal_products.is_deleted,
      ((${permissive}) AND (${restrictive})) AS visible
      FROM ctx CROSS JOIN fixture_deals deal_products`;
  });
  results = query(`WITH ctx(role_name,admin,seller,allowed_account) AS (VALUES
    ('seller',false,true,true),('seller_outside_account',false,true,false),
    ('admin',true,false,true),('admin_seller',true,true,true),('viewer',false,false,true)),
    fixture_deals(id,deal_id,status,is_deleted) AS (VALUES
    (1,1,'won',false),(2,2,'open',false),(3,3,'lost',false),(4,4,'won',true))
    ${rules.join(' UNION ALL ')}`);
}, 60000);

function visible(role: string, table: string) {
  return results.filter(r => r.role_name === role && r.table_name === table && r.visible === true);
}
describe('Pipedrive: expressões RLS publicadas, avaliadas pelo PostgreSQL', () => {
  it('seller vê somente won não excluído', () => {
    expect(visible('seller', 'deals').map(r => [r.status, r.is_deleted])).toEqual([['won', false]]);
  });
  it('seller vê apenas produtos de negócios won não excluídos', () => {
    expect(visible('seller', 'deal_products').map(r => [r.status, r.is_deleted])).toEqual([['won', false]]);
  });
  it('seller lê catálogo sem filtro adicional', () => { expect(visible('seller', 'crm_products')).toHaveLength(4); });
  for (const table of ['deal_installments', 'crm_leads', 'crm_organizations']) {
    it(`seller não lê ${table}`, () => { expect(visible('seller', table)).toHaveLength(0); });
  }
  for (const command of ['INSERT', 'UPDATE', 'DELETE']) {
    it(`seller não recebe permissão ${command} nas seis tabelas`, () => {
      for (const table of tables) {
        const writes = policies.filter(p => p.tablename === table && [command, 'ALL'].includes(p.cmd));
        expect(writes).toHaveLength(1);
        expect(writes[0].qual).toBe("has_role(auth.uid(), 'admin'::app_role)");
        expect(writes[0].with_check).toBe("has_role(auth.uid(), 'admin'::app_role)");
      }
    });
  }
  for (const role of ['admin', 'admin_seller', 'viewer']) {
    it(`${role} mantém leitura sem restrições seller`, () => {
      for (const table of tables) expect(visible(role, table)).toHaveLength(4);
    });
  }
  it('seller não ganha acesso a outras contas', () => {
    for (const table of tables) expect(visible('seller_outside_account', table)).toHaveLength(0);
  });
});