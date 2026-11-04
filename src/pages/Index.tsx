import { Navigate } from "react-router-dom";
import { SellerHome } from "@/components/dashboard/SellerHome";
import { useAuth } from "@/hooks/useAuth";

// A equipe de vendas vê só o próprio ranking; os demais vão para a página Comercial.
// Comercial e Marketing têm página própria (/comercial e /marketing).
export default function Index() {
  const { isSeller } = useAuth();
  return isSeller ? <SellerHome /> : <Navigate to="/comercial" replace />;
}
