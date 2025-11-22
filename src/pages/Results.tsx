import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ResultItem {
  question: string;
  options: string[];
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const { results, score, total } = location.state as {
    results: ResultItem[];
    score: number;
    total: number;
  } || { results: [], score: 0, total: 0 };

  const percentage = (score / total) * 100;
  const options = ['A', 'B', 'C', 'D'];

  if (results.length === 0) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent to-background p-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Score Card */}
        <Card className="p-8 text-center">
          <h1 className="text-3xl font-bold mb-6 text-foreground">Exam Results</h1>
          
          <div className="space-y-4 mb-8">
            <div className="text-6xl font-bold text-primary">
              {score}/{total}
            </div>
            <Progress value={percentage} className="h-3" />
            <p className="text-xl text-muted-foreground">
              You scored {percentage.toFixed(1)}%
            </p>
          </div>

          <div className="flex gap-4 justify-center">
            <Button onClick={() => navigate('/')} variant="outline" size="lg">
              <Home className="w-5 h-5 mr-2" />
              New Exam
            </Button>
            <Button onClick={() => navigate(-1)} size="lg">
              <RotateCcw className="w-5 h-5 mr-2" />
              Retake
            </Button>
          </div>
        </Card>

        {/* Wrong Answers Section */}
        {results.filter(r => !r.isCorrect).length > 0 && (
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-foreground">
              Review Incorrect Answers
            </h2>
            <p className="text-muted-foreground mb-6">
              Let's learn from these questions
            </p>
            
            <div className="space-y-6">
              {results.map((result, idx) => {
                if (result.isCorrect) return null;

                return (
                  <Card key={idx} className="p-6 border-destructive/20 bg-destructive/5">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <XCircle className="w-6 h-6 text-destructive flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-4 text-foreground">
                            {result.question}
                          </h3>
                          
                          <div className="space-y-3">
                            {result.options.map((option, optIdx) => {
                              const optionLetter = options[optIdx];
                              const isCorrect = optionLetter === result.correctAnswer;
                              const isUserAnswer = optionLetter === result.userAnswer;

                              return (
                                <div
                                  key={optIdx}
                                  className={`p-3 rounded-lg ${
                                    isCorrect
                                      ? 'bg-primary/10 border-2 border-primary'
                                      : isUserAnswer
                                      ? 'bg-destructive/10 border-2 border-destructive'
                                      : 'bg-muted'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    {isCorrect && (
                                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                    )}
                                    {isUserAnswer && !isCorrect && (
                                      <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                                    )}
                                    <span className="flex-1">
                                      <span className="font-semibold mr-2">{optionLetter}.</span>
                                      {option}
                                      {isCorrect && (
                                        <span className="ml-2 text-sm font-semibold text-primary">
                                          Correct Answer
                                        </span>
                                      )}
                                      {isUserAnswer && !isCorrect && (
                                        <span className="ml-2 text-sm font-semibold text-destructive">
                                          Your Answer
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </Card>
        )}

        {/* All Correct Section */}
        {results.filter(r => !r.isCorrect).length === 0 && (
          <Card className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Perfect Score! 🎉
            </h2>
            <p className="text-muted-foreground">
              You answered all questions correctly. Excellent work!
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}