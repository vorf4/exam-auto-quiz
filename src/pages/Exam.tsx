import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
}

export default function Exam() {
  const location = useLocation();
  const navigate = useNavigate();
  const questions = location.state?.questions as Question[] || [];
  
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  useEffect(() => {
    if (questions.length === 0) {
      navigate('/');
    }
  }, [questions, navigate]);

  const handleAnswer = (optionIndex: string) => {
    setAnswers({ ...answers, [currentQuestion]: optionIndex });
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = () => {
    // Calculate results
    let correctCount = 0;
    const results = questions.map((q, idx) => {
      const userAnswer = answers[idx] || '';
      const isCorrect = userAnswer === q.correctAnswer;
      if (isCorrect) correctCount++;
      
      return {
        question: q.question,
        options: q.options,
        userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect,
      };
    });

    navigate('/results', { 
      state: { 
        results,
        score: correctCount,
        total: questions.length,
      } 
    });
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  if (questions.length === 0) {
    return null;
  }

  const currentQ = questions[currentQuestion];
  const options = ['A', 'B', 'C', 'D'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent to-background p-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-foreground">ExamFlow</h1>
              <div className="text-sm text-muted-foreground">
                Question {currentQuestion + 1} of {questions.length}
              </div>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="text-sm text-muted-foreground text-center">
              {answeredCount} of {questions.length} questions answered
            </div>
          </div>
        </Card>

        {/* Question Card */}
        <Card className="p-8">
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground">
              {currentQ.question}
            </h2>

            <RadioGroup
              value={answers[currentQuestion] || ''}
              onValueChange={handleAnswer}
              className="space-y-4"
            >
              {currentQ.options.map((option, idx) => (
                <div key={idx} className="flex items-start space-x-3">
                  <RadioGroupItem value={options[idx]} id={`option-${idx}`} />
                  <Label
                    htmlFor={`option-${idx}`}
                    className="flex-1 cursor-pointer text-base leading-relaxed"
                  >
                    <span className="font-semibold text-primary mr-2">{options[idx]}.</span>
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </Card>

        {/* Navigation */}
        <Card className="p-6">
          <div className="flex justify-between items-center gap-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              size="lg"
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Previous
            </Button>

            <div className="flex gap-2">
              {questions.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentQuestion(idx)}
                  className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${
                    idx === currentQuestion
                      ? 'bg-primary text-primary-foreground'
                      : answers[idx]
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            {currentQuestion === questions.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={answeredCount < questions.length}
                size="lg"
              >
                Submit Exam
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                size="lg"
              >
                Next
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}