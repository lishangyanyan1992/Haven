"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type DashboardSectionMap = Record<string, string>;

type StoredDashboardChanges = {
  loginKey: string;
  referenceSections: DashboardSectionMap | null;
  currentSections: DashboardSectionMap;
  changedKeys: string[];
};

const DashboardChangeContext = createContext<Set<string> | null>(null);

export function DashboardChangeProvider({
  storageKey,
  loginKey,
  sections,
  children
}: {
  storageKey: string;
  loginKey: string;
  sections: DashboardSectionMap;
  children: React.ReactNode;
}) {
  const [changedKeys, setChangedKeys] = useState<string[]>([]);
  const sectionsJson = JSON.stringify(sections);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let stored: StoredDashboardChanges | null = null;

    try {
      const raw = window.localStorage.getItem(storageKey);
      stored = raw ? JSON.parse(raw) as StoredDashboardChanges : null;
    } catch {
      stored = null;
    }

    const referenceSections =
      stored?.loginKey === loginKey
        ? stored.referenceSections
        : stored?.currentSections ?? null;

    const nextChangedKeys = referenceSections
      ? Object.keys(sections).filter((key) => referenceSections[key] !== sections[key])
      : [];

    const nextStored: StoredDashboardChanges = {
      loginKey,
      referenceSections,
      currentSections: sections,
      changedKeys: nextChangedKeys
    };

    window.localStorage.setItem(storageKey, JSON.stringify(nextStored));
    setChangedKeys(nextChangedKeys);
  }, [loginKey, sections, sectionsJson, storageKey]);

  const changedSet = useMemo(() => new Set(changedKeys), [changedKeys]);

  return <DashboardChangeContext.Provider value={changedSet}>{children}</DashboardChangeContext.Provider>;
}

export function DashboardChangeHighlight({
  sectionId,
  children,
  className
}: {
  sectionId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const changedSections = useContext(DashboardChangeContext);
  const isChanged = changedSections?.has(sectionId) ?? false;

  return (
    <div
      className={cn(
        "space-y-3 transition-colors",
        isChanged && "rounded-[var(--radius-xl)] border border-[var(--haven-sky-mid)] bg-[rgba(205,228,237,0.34)] p-3 md:p-4",
        className
      )}
    >
      {isChanged ? (
        <div className="flex items-center">
          <Badge variant="pending">Updated since last login</Badge>
        </div>
      ) : null}
      {children}
    </div>
  );
}
