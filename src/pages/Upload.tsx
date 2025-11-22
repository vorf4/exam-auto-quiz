import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Upload as UploadIcon, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Upload() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const validateFile = (file: File): boolean => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or image file (PNG, JPG, JPEG)",
        variant: "destructive",
      });
      return false;
    }

    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "File size must be less than 10MB",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleFile = useCallback((selectedFile: File) => {
    if (validateFile(selectedFile)) {
      setFile(selectedFile);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsUploading(true);

    try {
      // Upload file to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('exam-files')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Call edge function to extract questions
      const { data, error: functionError } = await supabase.functions.invoke('extract-questions', {
        body: { filePath },
      });

      if (functionError) {
        throw functionError;
      }

      if (!data.questions || data.questions.length === 0) {
        toast({
          title: "No questions found",
          description: "Could not extract any questions from the file. Please try another file.",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }

      // Navigate to exam page with questions
      navigate('/exam', { state: { questions: data.questions } });

    } catch (error: any) {
      console.error('Error processing file:', error);
      toast({
        title: "Error processing file",
        description: error.message || "Failed to extract questions. Please try again.",
        variant: "destructive",
      });
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground">ExamFlow</h1>
          <p className="text-muted-foreground">Upload your exam questions to get started</p>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-all ${
            isDragging
              ? 'border-primary bg-primary/5 scale-[1.02]'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <input
            type="file"
            id="file-input"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleFileInput}
            disabled={isUploading}
          />
          
          {!file ? (
            <>
              <UploadIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2 text-foreground">
                Drop your file here
              </h3>
              <p className="text-muted-foreground mb-6">
                or click the button below to browse
              </p>
              <Button
                onClick={() => document.getElementById('file-input')?.click()}
                size="lg"
                disabled={isUploading}
              >
                <UploadIcon className="w-5 h-5 mr-2" />
                Choose File
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                Supported formats: PDF, PNG, JPG (max 10MB)
              </p>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 text-primary">
                {file.type === 'application/pdf' ? (
                  <FileText className="w-12 h-12" />
                ) : (
                  <Image className="w-12 h-12" />
                )}
                <div className="text-left">
                  <p className="font-semibold text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={processFile}
                  disabled={isUploading}
                  size="lg"
                >
                  {isUploading ? 'Processing...' : 'Start Exam'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setFile(null)}
                  disabled={isUploading}
                  size="lg"
                >
                  Remove
                </Button>
              </div>
            </div>
          )}
        </div>

        {isUploading && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-primary">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Extracting questions from your file...
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}