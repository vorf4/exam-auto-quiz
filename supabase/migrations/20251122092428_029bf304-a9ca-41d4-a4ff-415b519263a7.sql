-- Create storage bucket for exam files
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-files', 'exam-files', false);

-- Create RLS policies for exam files bucket
CREATE POLICY "Anyone can upload exam files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exam-files');

CREATE POLICY "Users can read their own exam files"
ON storage.objects FOR SELECT
USING (bucket_id = 'exam-files');