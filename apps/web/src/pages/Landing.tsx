import { useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Activity, Brain, Shield, Search, FileText, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

const GridBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Vertical lines */}
    <div className="absolute inset-0 flex justify-between px-8 lg:px-16">
      {[...Array(6)].map((_, i) => (
        <div 
          key={i} 
          className="w-px h-full bg-border/30"
          style={{ opacity: i === 0 || i === 5 ? 0.5 : 0.2 }}
        />
      ))}
    </div>
    {/* Horizontal lines */}
    <div className="absolute inset-0 flex flex-col justify-between py-8 lg:py-16">
      {[...Array(8)].map((_, i) => (
        <div 
          key={i} 
          className="w-full h-px bg-border/20"
        />
      ))}
    </div>
    {/* Floating accent squares */}
    <motion.div 
      className="absolute top-24 left-16 w-2 h-2 bg-accent"
      animate={{ opacity: [0.4, 1, 0.4] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div 
      className="absolute top-48 right-24 w-2 h-2 bg-accent"
      animate={{ opacity: [1, 0.4, 1] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div 
      className="absolute bottom-32 left-1/4 w-2 h-2 bg-accent"
      animate={{ opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div 
      className="absolute bottom-48 right-1/3 w-2 h-2 bg-accent"
      animate={{ opacity: [0.8, 0.3, 0.8] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);

// Research Pipeline Visualization - Animated funnel showing idea flow
const ResearchPipeline = () => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, -30]);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center p-8"
      style={{ y }}
    >
      <div className="relative w-full h-full max-w-[500px] max-h-[500px]">
        {/* Central hexagon structure */}
        <svg viewBox="0 0 400 400" className="w-full h-full">
          <defs>
            <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(82, 145, 135)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="rgb(82, 145, 135)" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgb(82, 145, 135)" stopOpacity="0" />
              <stop offset="50%" stopColor="rgb(82, 145, 135)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="rgb(82, 145, 135)" stopOpacity="0" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Concentric rings */}
          {[160, 120, 80, 40].map((r, i) => (
            <motion.circle
              key={r}
              cx="200"
              cy="200"
              r={r}
              fill="none"
              stroke="rgb(82, 145, 135)"
              strokeWidth="1"
              strokeOpacity={0.15 + i * 0.05}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, delay: i * 0.15 }}
            />
          ))}

          {/* Rotating outer ring with dashes */}
          <motion.circle
            cx="200"
            cy="200"
            r="175"
            fill="none"
            stroke="rgb(82, 145, 135)"
            strokeWidth="1"
            strokeOpacity="0.3"
            strokeDasharray="8 16"
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "200px 200px" }}
          />

          {/* Hex grid pattern */}
          <g opacity="0.1">
            {[0, 60, 120, 180, 240, 300].map((angle) => (
              <line
                key={angle}
                x1="200"
                y1="200"
                x2={200 + 170 * Math.cos((angle * Math.PI) / 180)}
                y2={200 + 170 * Math.sin((angle * Math.PI) / 180)}
                stroke="rgb(82, 145, 135)"
                strokeWidth="1"
              />
            ))}
          </g>

          {/* Data flow paths - curved lines flowing inward */}
          {[0, 72, 144, 216, 288].map((angle, i) => {
            const startX = 200 + 165 * Math.cos((angle * Math.PI) / 180);
            const startY = 200 + 165 * Math.sin((angle * Math.PI) / 180);
            const midX = 200 + 100 * Math.cos(((angle + 20) * Math.PI) / 180);
            const midY = 200 + 100 * Math.sin(((angle + 20) * Math.PI) / 180);
            const endX = 200 + 35 * Math.cos(((angle + 36) * Math.PI) / 180);
            const endY = 200 + 35 * Math.sin(((angle + 36) * Math.PI) / 180);
            
            return (
              <g key={`path-${i}`}>
                <motion.path
                  d={`M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`}
                  fill="none"
                  stroke="url(#lineGrad)"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, delay: 0.5 + i * 0.2 }}
                />
                
                {/* Animated particle */}
                <motion.circle
                  r="3"
                  fill="rgb(82, 145, 135)"
                  filter="url(#glow)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0] }}
                  transition={{
                    duration: 2.5,
                    delay: 1 + i * 0.5,
                    repeat: Infinity,
                    repeatDelay: 3,
                  }}
                >
                  <animateMotion
                    dur="2.5s"
                    repeatCount="indefinite"
                    begin={`${1 + i * 0.5}s`}
                    path={`M ${startX - 200} ${startY - 200} Q ${midX - 200} ${midY - 200} ${endX - 200} ${endY - 200}`}
                  />
                </motion.circle>
              </g>
            );
          })}

          {/* Stage nodes on the rings */}
          {[
            { label: 'DISCOVERY', angle: 0, r: 145 },
            { label: 'SCREEN', angle: 72, r: 145 },
            { label: 'GATE', angle: 144, r: 145 },
            { label: 'RESEARCH', angle: 216, r: 145 },
            { label: 'DECISION', angle: 288, r: 145 },
          ].map((node, i) => {
            const x = 200 + node.r * Math.cos((node.angle * Math.PI) / 180);
            const y = 200 + node.r * Math.sin((node.angle * Math.PI) / 180);
            
            return (
              <motion.g
                key={node.label}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
              >
                <motion.circle
                  cx={x}
                  cy={y}
                  r="20"
                  fill="rgb(20, 22, 27)"
                  stroke="rgb(82, 145, 135)"
                  strokeWidth="1.5"
                  strokeOpacity="0.6"
                />
                <motion.circle
                  cx={x}
                  cy={y}
                  r="6"
                  fill="rgb(82, 145, 135)"
                  fillOpacity="0.5"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 3, repeat: Infinity, delay: i * 0.3 }}
                />
                <text
                  x={x}
                  y={y + 35}
                  textAnchor="middle"
                  fill="rgb(140, 145, 155)"
                  fontSize="8"
                  fontFamily="Inter, system-ui"
                  letterSpacing="0.1em"
                >
                  {node.label}
                </text>
              </motion.g>
            );
          })}

          {/* Central core */}
          <motion.g
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.6, delay: 1.2 }}
          >
            <motion.circle
              cx="200"
              cy="200"
              r="28"
              fill="rgb(82, 145, 135)"
              fillOpacity="0.1"
              stroke="rgb(82, 145, 135)"
              strokeWidth="2"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            <motion.circle
              cx="200"
              cy="200"
              r="12"
              fill="rgb(82, 145, 135)"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.g>

          {/* Status indicator */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
          >
            <motion.rect
              x="20"
              y="370"
              width="6"
              height="6"
              fill="rgb(77, 124, 104)"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <text
              x="34"
              y="377"
              fill="rgb(140, 145, 155)"
              fontSize="9"
              fontFamily="Inter, system-ui"
              letterSpacing="0.05em"
            >
              ACTIVE
            </text>
          </motion.g>
        </svg>

        {/* Corner accents */}
        <motion.div 
          className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-accent/30"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.5 }}
        />
        <motion.div 
          className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-accent/30"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.6 }}
        />
        <motion.div 
          className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-accent/30"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.7 }}
        />
        <motion.div 
          className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-accent/30"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.8 }}
        />
      </div>
    </motion.div>
  );
};

const CapabilityCard = ({ 
  icon: Icon, 
  title, 
  description, 
  delay 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string; 
  delay: number;
}) => (
  <motion.div
    className="group relative p-6 lg:p-8 border border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card transition-all duration-500"
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6, delay }}
    whileHover={{ y: -4 }}
  >
    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="flex items-start gap-4">
      <div className="p-3 bg-secondary/50 rounded-md">
        <Icon className="w-5 h-5 text-accent" />
      </div>
      <div className="flex-1">
        <h3 className="text-subsection text-foreground mb-2">{title}</h3>
        <p className="text-supporting text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  </motion.div>
);

const StatBlock = ({ value, label, delay }: { value: string; label: string; delay: number }) => (
  <motion.div
    className="text-center"
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6, delay }}
  >
    <div className="text-3xl lg:text-4xl font-medium text-foreground tracking-tight">{value}</div>
    <div className="text-label text-muted-foreground mt-2">{label}</div>
  </motion.div>
);

const Landing = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <GridBackground />
      
      {/* Header */}
      <motion.header 
        className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center justify-between px-8 lg:px-16 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-foreground rounded-sm flex items-center justify-center">
              <span className="text-background font-medium text-sm">A</span>
            </div>
            <span className="font-medium text-foreground tracking-tight">ARC</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <span className="text-annotation text-muted-foreground">System</span>
            <span className="text-annotation text-muted-foreground">Discovery</span>
            <span className="text-annotation text-muted-foreground">Research</span>
            <span className="text-annotation text-muted-foreground">Governance</span>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button 
              onClick={() => navigate("/status")}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Enter System
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center">
        <div className="container mx-auto px-8 lg:px-16 pt-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative z-10">
              <motion.div
                className="flex items-center gap-2 mb-6"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <div className="w-2 h-2 bg-accent" />
                <span className="text-label text-muted-foreground">AUTONOMOUS RESEARCH</span>
              </motion.div>

              <motion.h1 
                className="text-4xl lg:text-6xl font-medium text-foreground tracking-tight leading-[1.1] mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                DISCIPLINED
                <br />
                <span className="text-muted-foreground">DISCOVERY</span>
              </motion.h1>

              <motion.p 
                className="text-lg text-muted-foreground max-w-md mb-8 leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
              >
                Systematic identification of asymmetric opportunities through governance-first investment research.
              </motion.p>

              <motion.div
                className="flex flex-wrap gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.7 }}
              >
                <Button 
                  size="lg"
                  onClick={() => navigate("/status")}
                  className="bg-foreground text-background hover:bg-foreground/90"
                >
                  Enter System
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-border hover:bg-secondary"
                >
                  View Documentation
                </Button>
              </motion.div>

              {/* Live status indicator */}
              <motion.div 
                className="mt-12 flex items-center gap-6 text-annotation text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.9 }}
              >
                <div className="flex items-center gap-2">
                  <motion.div 
                    className="w-2 h-2 rounded-full bg-success"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span>System operational</span>
                </div>
                <span className="font-mono">
                  {currentTime.toLocaleTimeString('en-US', { hour12: false })} UTC
                </span>
              </motion.div>
            </div>

            <div className="relative hidden lg:block h-[600px]">
              <ResearchPipeline />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-px h-16 bg-gradient-to-b from-transparent via-border to-transparent" />
        </motion.div>
      </section>

      {/* Capabilities Section */}
      <section className="relative py-24 lg:py-32 border-t border-border/50">
        <div className="container mx-auto px-8 lg:px-16">
          <motion.div
            className="flex items-center gap-2 mb-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <div className="w-2 h-2 bg-accent" />
            <span className="text-label text-muted-foreground">SYSTEM CAPABILITIES</span>
          </motion.div>

          <motion.h2 
            className="text-3xl lg:text-4xl font-medium text-foreground tracking-tight mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Systematic Process
          </motion.h2>
          
          <motion.p 
            className="text-muted-foreground max-w-lg mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            Each idea passes through structured gates before commitment. The system prioritizes discipline over speed.
          </motion.p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CapabilityCard 
              icon={Search}
              title="Idea Discovery"
              description="Continuous screening across filings, transcripts, and market data. New hypotheses surface daily without manual intervention."
              delay={0}
            />
            <CapabilityCard 
              icon={Brain}
              title="Deep Research"
              description="Variant perception analysis with base case, downside case, and pre-mortem scenarios. Evidence-based thesis construction."
              delay={0.1}
            />
            <CapabilityCard 
              icon={Shield}
              title="Gate Validation"
              description="Multi-gate governance ensures ideas meet quality thresholds before promotion. Rejection reasons preserved in memory."
              delay={0.2}
            />
            <CapabilityCard 
              icon={FileText}
              title="Research Packets"
              description="Decision-ready documentation with invalidation triggers, risk assessment, and alternative outcomes clearly stated."
              delay={0.3}
            />
            <CapabilityCard 
              icon={Activity}
              title="System Monitoring"
              description="Real-time visibility into discovery runs, evidence coverage, and thesis generation. Operational transparency by default."
              delay={0.4}
            />
            <CapabilityCard 
              icon={BarChart3}
              title="Quality Governance"
              description="Weekly QA reports tracking novelty, evidence quality, and gate breaches. Institutional memory prevents repeated errors."
              delay={0.5}
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-24 border-t border-border/50 bg-secondary/20">
        <div className="container mx-auto px-8 lg:px-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-16">
            <StatBlock value="94%" label="Evidence Coverage" delay={0} />
            <StatBlock value="847" label="Ideas Screened" delay={0.1} />
            <StatBlock value="12" label="Active Research" delay={0.2} />
            <StatBlock value="<3min" label="Gate Processing" delay={0.3} />
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="relative py-24 lg:py-32 border-t border-border/50">
        <div className="container mx-auto px-8 lg:px-16">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.div
                className="flex items-center gap-2 mb-4"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                <div className="w-2 h-2 bg-accent" />
                <span className="text-label text-muted-foreground">PHILOSOPHY</span>
              </motion.div>

              <motion.h2 
                className="text-3xl lg:text-4xl font-medium text-foreground tracking-tight mb-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                Governance Over Conviction
              </motion.h2>

              <motion.div 
                className="space-y-4 text-muted-foreground"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
              >
                <p>
                  ARC does not predict outcomes or generate signals. It structures judgment through systematic discovery and disciplined gates.
                </p>
                <p>
                  Every idea carries its rejection shadow. Every thesis documents its invalidation triggers. The system protects against overconfidence through institutional memory.
                </p>
                <p className="font-medium text-foreground">
                  Uncertainty acknowledged. Discipline preserved.
                </p>
              </motion.div>
            </div>

            <motion.div 
              className="relative"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <div className="border border-border p-8 bg-card">
                <div className="text-label text-muted-foreground mb-4">SYSTEM PRINCIPLES</div>
                <ul className="space-y-4">
                  {[
                    "Ideas require evidence, not conviction",
                    "Downside analysis precedes upside modeling",
                    "Past rejections inform future evaluation",
                    "Transparency over performance theater",
                    "Process quality over outcome luck"
                  ].map((principle, i) => (
                    <motion.li 
                      key={i}
                      className="flex items-center gap-3 text-foreground"
                      initial={{ opacity: 0, x: 10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                    >
                      <div className="w-1.5 h-1.5 bg-accent flex-shrink-0" />
                      <span>{principle}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 border-t border-border/50">
        <div className="container mx-auto px-8 lg:px-16 text-center">
          <motion.h2 
            className="text-3xl lg:text-4xl font-medium text-foreground tracking-tight mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Enter the System
          </motion.h2>
          
          <motion.p 
            className="text-muted-foreground max-w-md mx-auto mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            View current system status, active research, and pending decisions.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Button 
              size="lg"
              onClick={() => navigate("/status")}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              View System Status
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-8 border-t border-border/50">
        <div className="container mx-auto px-8 lg:px-16">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-foreground rounded-sm flex items-center justify-center">
                <span className="text-background font-medium text-xs">A</span>
              </div>
              <span className="text-annotation text-muted-foreground">ARC Investment Factory</span>
            </div>
            
            <div className="text-annotation text-muted-foreground">
              Institutional Design System v1.0
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
