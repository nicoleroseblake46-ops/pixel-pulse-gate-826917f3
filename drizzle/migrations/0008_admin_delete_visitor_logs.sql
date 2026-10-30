GRANT DELETE ON public.visitor_logs TO authenticated;
CREATE POLICY "Admins delete visitor logs" ON public.visitor_logs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));