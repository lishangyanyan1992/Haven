"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  yOffset?: number;
  duration?: number;
  staggerChildren?: number;
  isStaggerContainer?: boolean;
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
  yOffset = 30,
  duration = 0.6,
  staggerChildren,
  isStaggerContainer = false,
}: ScrollRevealProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: staggerChildren || 0.1,
        delayChildren: delay,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: yOffset },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
      },
    },
  };

  if (isStaggerContainer) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-100px" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ScrollRevealItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
      },
    },
  };

  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}
