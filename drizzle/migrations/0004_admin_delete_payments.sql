GRANT DELETE ON public.payments TO authenticated;
CREATE POLICY "Admins delete payments" ON public.payments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));