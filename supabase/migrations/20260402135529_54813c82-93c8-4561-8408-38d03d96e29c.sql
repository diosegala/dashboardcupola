CREATE POLICY "Authenticated users can delete goals"
ON public.goals FOR DELETE TO authenticated USING (true);