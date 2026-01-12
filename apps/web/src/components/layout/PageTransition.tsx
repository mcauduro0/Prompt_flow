import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export const PageTransition = ({ children, className = "" }: PageTransitionProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        transition: {
          duration: 0.4,
          ease: [0.25, 0.1, 0.25, 1] as const,
        },
      }}
      exit={{ 
        opacity: 0, 
        y: -8,
        transition: {
          duration: 0.3,
          ease: [0.25, 0.1, 0.25, 1] as const,
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
