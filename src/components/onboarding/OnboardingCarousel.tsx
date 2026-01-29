import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Eye, Target, Rocket, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingSlide {
  id: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}

const slides: OnboardingSlide[] = [
  {
    id: 1,
    icon: <Eye className="h-12 w-12" />,
    title: 'Clareza Total',
    description: 'Enxergue cada centavo. O fim das surpresas no fim do mês.',
    gradient: 'from-primary/30 to-primary/10',
  },
  {
    id: 2,
    icon: <Target className="h-12 w-12" />,
    title: 'Poder de Decisão',
    description: 'Simulações inteligentes para você escolher o melhor caminho.',
    gradient: 'from-accent/30 to-accent/10',
  },
  {
    id: 3,
    icon: <Rocket className="h-12 w-12" />,
    title: 'Seu Futuro',
    description: 'Não controle apenas os gastos. Construa patrimônio.',
    gradient: 'from-emerald-500/30 to-emerald-500/10',
  },
];

interface OnboardingCarouselProps {
  onComplete: () => void;
  onNavigateToSignup?: () => void;
}

export function OnboardingCarousel({ onComplete, onNavigateToSignup }: OnboardingCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const AUTO_PLAY_INTERVAL = 5000;

  const nextSlide = useCallback(() => {
    setDirection(1);
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, []);

  const prevSlide = useCallback(() => {
    setDirection(-1);
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }, []);

  const goToSlide = useCallback((index: number) => {
    setDirection(index > currentSlide ? 1 : -1);
    setCurrentSlide(index);
  }, [currentSlide]);

  // Auto-play
  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(() => {
      nextSlide();
    }, AUTO_PLAY_INTERVAL);

    return () => clearInterval(interval);
  }, [isPaused, nextSlide]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
  };

  const slide = slides[currentSlide];

  return (
    <div 
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Hypnotic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-accent/20" />
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--primary) / 0.3) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />
      
      {/* Animated Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-primary/20 blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 h-48 w-48 rounded-full bg-accent/20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      {/* Content Container */}
      <div className="relative z-10 flex w-full max-w-lg flex-col items-center px-6">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 flex items-center gap-3"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-primary-foreground"
            >
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">
            Locus <span className="text-primary">Finanças</span>
          </span>
        </motion.div>

        {/* Slide Container */}
        <div className="relative h-80 w-full overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={slide.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: 'spring', stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
              }}
              className="absolute inset-0 flex flex-col items-center justify-center text-center"
            >
              {/* Icon with Glow */}
              <div className={cn(
                "mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br shadow-2xl",
                slide.gradient
              )}>
                <div className="text-primary">
                  {slide.icon}
                </div>
              </div>

              {/* Title */}
              <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground">
                {slide.title}
              </h2>

              {/* Description */}
              <p className="max-w-sm text-lg text-muted-foreground">
                {slide.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Arrows (Desktop) */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 hidden md:block">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevSlide}
            className="h-10 w-10 rounded-full bg-card/50 backdrop-blur-sm hover:bg-card"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:block">
          <Button
            variant="ghost"
            size="icon"
            onClick={nextSlide}
            className="h-10 w-10 rounded-full bg-card/50 backdrop-blur-sm hover:bg-card"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Dots Indicator */}
        <div className="mb-8 flex gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                currentSlide === index
                  ? "w-8 bg-primary"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full max-w-xs"
        >
          <Button
            onClick={onNavigateToSignup || onComplete}
            size="lg"
            className="w-full gap-2 bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/40 transition-all"
            data-testid="btn-start-journey"
          >
            <Rocket className="h-5 w-5" />
            Começar a Jornada
          </Button>
        </motion.div>

        {/* Skip Link - Login */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          onClick={onComplete}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Já tenho conta? <span className="text-primary font-medium">Entrar</span>
        </motion.button>
      </div>

      {/* Swipe hint (Mobile) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs text-muted-foreground md:hidden"
      >
        <ChevronLeft className="h-4 w-4 animate-pulse" />
        <span>Deslize para navegar</span>
        <ChevronRight className="h-4 w-4 animate-pulse" />
      </motion.div>
    </div>
  );
}
