CREATE POLICY "Authenticated users can update goals"
ON public.goals
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);