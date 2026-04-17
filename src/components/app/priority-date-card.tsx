"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarClock, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { ValueType } from "recharts/types/component/DefaultTooltipContent";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PriorityDateIntelligence } from "@/types/domain";

interface PriorityDateCardProps {
  intelligence: PriorityDateIntelligence | null;
}

function formatAxisDate(value: number) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC"
  });
}

function formatTooltipValue(value: ValueType | undefined) {
  if (typeof value === "number") {
    return formatAxisDate(value);
  }

  if (Array.isArray(value)) {
    const firstNumber = value.find((entry): entry is number => typeof entry === "number");
    return typeof firstNumber === "number" ? formatAxisDate(firstNumber) : value.join(", ");
  }

  return String(value ?? "");
}

function formatTooltipLabel(label: string | number) {
  return String(label);
}

function formatSourcePulledAt(value?: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function PriorityDateCard({ intelligence }: PriorityDateCardProps) {
  const chartPoints =
    intelligence?.historyPoints
      .filter((point) => typeof point.cutoffTimestamp === "number")
      .map((point) => ({
        label: point.label,
        cutoffLabel: point.cutoffLabel,
        cutoffTimestamp: point.cutoffTimestamp as number
      })) ?? [];
  const sourcePulledAt = formatSourcePulledAt(intelligence?.sourcePulledAt);

  return (
    <Card variant="alert" className="h-full">
      <CardHeader>
        <div>
          <p className="text-label">Priority date intelligence</p>
          <CardTitle className="mt-2">Official visa bulletin movement for your case</CardTitle>
        </div>
        <TrendingUp className="h-5 w-5 text-[var(--haven-sky-ink)]" />
      </CardHeader>
      <CardContent className="space-y-4">
        {intelligence ? (
          <>
            <div className="rounded-[var(--radius-lg)] bg-[var(--haven-white)] p-4">
              <p className="text-label">Source</p>
              <p className="mt-2 text-body-sm">Weekly sync from the official U.S. Department of State Visa Bulletin.</p>
              {sourcePulledAt ? <p className="mt-2 text-caption">Last pulled {sourcePulledAt}</p> : null}
            </div>

            <div className="rounded-[var(--radius-lg)] bg-[var(--haven-white)] p-4">
              <p className="text-label">
                Current {intelligence.category} {intelligence.country} cutoff
              </p>
              <p className="mt-2 text-h3">{intelligence.latestCutoffLabel}</p>
              <p className="mt-2 text-body-sm text-[var(--color-text-secondary)]">
                {intelligence.latestBulletinLabel} final action dates bulletin
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[var(--radius-lg)] bg-[var(--haven-white)] p-4">
                <p className="text-label">Gap</p>
                <p className="mt-2 text-body-sm">
                  {intelligence.gapLabel ?? "Your priority date is already current under final action dates."}
                </p>
              </div>
              <div className="rounded-[var(--radius-lg)] bg-[var(--haven-white)] p-4">
                <p className="text-label">Estimate</p>
                <p className="mt-2 text-body-sm">
                  {intelligence.estimateLabel ?? "Haven needs more bulletin history to estimate when your date may become current."}
                </p>
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] bg-[var(--haven-white)] p-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-[var(--haven-sky-ink)]" />
                <p className="text-label">Signal</p>
              </div>
              <p className="mt-3 text-body-sm">{intelligence.visaBulletinPosition}</p>
              {intelligence.velocityLabel ? (
                <p className="mt-2 text-caption">Using {intelligence.velocityLabel} as the current movement baseline.</p>
              ) : null}
            </div>

            {chartPoints.length >= 3 ? (
              <div className="rounded-[var(--radius-lg)] bg-[var(--haven-white)] p-4">
                <p className="text-label">Recent movement</p>
                <div className="mt-4 h-56">
                  <ResponsiveContainer height="100%" width="100%">
                    <AreaChart data={chartPoints} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="priorityCutoffFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="var(--haven-sky)" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="var(--haven-sky-light)" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(122, 142, 134, 0.18)" vertical={false} />
                      <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis
                        dataKey="cutoffTimestamp"
                        domain={["dataMin", "dataMax"]}
                        fontSize={12}
                        tickFormatter={formatAxisDate}
                        tickLine={false}
                        axisLine={false}
                        width={68}
                      />
                      <Tooltip
                        formatter={(value) => formatTooltipValue(value)}
                        labelFormatter={(label) => formatTooltipLabel(label ?? "")}
                        contentStyle={{
                          borderRadius: "16px",
                          border: "1px solid var(--color-border)",
                          background: "var(--haven-white)"
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="cutoffTimestamp"
                        stroke="var(--haven-sky)"
                        strokeWidth={2}
                        fill="url(#priorityCutoffFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="rounded-[var(--radius-lg)] bg-[var(--haven-white)] p-4 text-body-sm text-[var(--color-text-secondary)]">
                Haven will show a movement chart after at least 3 monthly bulletin syncs are available.
              </div>
            )}

            <Link
              className="inline-flex items-center gap-2 text-body-sm text-[var(--haven-ink)] underline-offset-4 hover:underline"
              href={intelligence.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open State Department source
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <div className="rounded-[var(--radius-lg)] bg-[var(--haven-white)] p-4">
            <p className="text-body-sm">
              Haven needs a synced visa bulletin and a known priority date category before it can replace the placeholder estimate with live queue data.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
