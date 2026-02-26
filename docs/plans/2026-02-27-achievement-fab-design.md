# Floating Achievement Trophy with Bottom Sheet — Design

**Date:** 2026-02-27
**Goal:** Replace the inline achievements grid on the dashboard with a floating trophy button that opens a bottom sheet panel, decluttering the dashboard.

## Trigger: Floating Action Button

- Fixed bottom-right corner (bottom-6 right-6)
- Trophy emoji on amber-500 circular button with shadow
- Badge in top-right showing unlocked count (amber-700 bg, white text)
- Visible on all dashboard pages (lives in dashboard layout)

## Panel: Bottom Sheet

- Slides up from bottom, ~70% viewport height
- Semi-transparent backdrop (bg-black/30), closes on tap
- Rounded top corners (rounded-t-2xl), white background
- Drag handle bar at top for visual affordance
- Close on: backdrop tap or X button
- Content: existing AchievementGrid component with vertical scroll

## Dashboard Change

- Remove AchievementGrid section from dashboard page
- Dashboard becomes: greeting -> CTA -> stats -> recent dishes

## Component Structure

- `AchievementFAB` — floating button with badge (new, in dashboard layout)
- `AchievementBottomSheet` — slide-up panel (new, in dashboard layout)
- `AchievementGrid` — unchanged, reused inside the bottom sheet
