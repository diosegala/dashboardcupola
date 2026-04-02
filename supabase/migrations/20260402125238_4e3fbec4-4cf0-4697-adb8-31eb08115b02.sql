CREATE POLICY "Authenticated users can insert goals"
ON public.goals
FOR INSERT
TO authenticated
WITH CHECK (true);