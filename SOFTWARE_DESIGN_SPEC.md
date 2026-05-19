# Software Design Specification (SDD)

## 1. Introduction

### 1.1 Purpose

This document defines the software design for the **Bolão Copa 2026** application, a React single-page app for managing World Cup prediction pools. It describes the system architecture, components, data flow, interfaces, constraints, and deployment considerations.

### 1.2 Scope

The system enables users to join groups, make match predictions, view leaderboards, and track their standings. It integrates with Supabase for authentication, data persistence, and realtime updates, and consumes external football data and AI prediction services.

### 1.3 Definitions

- **Bolão**: Prediction pool where users predict match outcomes and compete for points.
- **Supabase**: Backend-as-a-service providing PostgreSQL, auth, and realtime subscriptions.
- **Football Data API**: External data provider for match results, standings, and schedule.
- **Gemini**: AI service used for generating predictive suggestions.

## 2. System Overview

### 2.1 System Context

The application is a web-based frontend that communicates with:

- Supabase backend for primary app data and user management
- Football Data API via a Vite proxy for match and standings data
- Google Gemini API for AI match predictions
- Google Sign-In for authentication

### 2.2 Key Features

- User authentication and profile management
- Group creation, joining, and membership handling
- Match prediction entry and scoring
- Leaderboard and classification views
- Tournament standings and knockout round prediction support
- Background sync to update match results and scores

## 3. Architecture

### 3.1 High-Level Architecture

The app is implemented as a React SPA. Runtime state is centralized in a single context provider: `contexts/DatabaseContext.tsx`. This provider composes several domain hooks responsible for different application concerns.

Components are separated into pages, shared root UI components, and reusable UI primitives.

### 3.2 Component Diagram

- `App.tsx` - Root app shell, renders routes and top-level layout
- `contexts/DatabaseContext.tsx` - Centralized state provider
- `hooks/` - Business logic hooks for user, match, group, leaderboard, sync, and points
- `components/pages/` - Route pages for main screens
- `components/` - Shared UI and feature cards
- `api/` - Thin request wrappers for external services
- `services/` - Client initialization for Supabase, Gemini, and live score updates
- `data/` - Static tournament seeds, teams, matches, and releases

### 3.3 Runtime State Management

The runtime state is maintained in custom hooks used by `DatabaseContext`:

- `useUserSystem` - authentication, user profiles, group membership
- `useMatchSystem` - match data, predictions, and scoring logic
- `useGroupSystem` - group creation and selection flows
- `useLeaderboard` - ranking and score aggregation
- `useSyncSystem` - polling external match data and writing updates
- `useBackgroundSync` - sync lifecycle management and refresh behavior
- `usePointsProcessor` - score calculations from match outcomes
- `usePasswordRecovery` - password reset flows

## 4. Data Model

### 4.1 Core Entities

- `User`
- `Group`
- `Match`
- `Prediction`
- `LeaderboardEntry`
- `Competition`
- `Team`
- `Stadium`

### 4.2 Data Sources

- `data/initialData.ts` seeds in-memory application state for initial startup.
- `data/` static files provide tournament metadata such as competitions, teams, stadiums, and initial matches.
- `database/migrations/` contain Supabase schema migrations and seed data for persistent storage.

### 4.3 Persistence

Persistent data is stored in Supabase PostgreSQL. The Supabase client is initialized in `services/supabase.ts` and accessed through API wrappers and hooks.

## 5. Detailed Design

### 5.1 Frontend Structure

#### 5.1.1 `App.tsx`
- Mounts `DatabaseContext`
- Renders application pages and navigation
- Controls routing and high-level presentation

#### 5.1.2 `contexts/DatabaseContext.tsx`
- Provides application-wide state and actions to components
- Composes multiple hooks into a unified interface
- Delegates updates and sync responsibilities to specialized hooks

#### 5.1.3 Pages
- `components/pages/MatchesPage.tsx`
- `components/pages/LeaderboardPage.tsx`
- `components/pages/SpecialsPage.tsx`
- `components/pages/StatsPage.tsx`
- `components/pages/TournamentPage.tsx`
- `components/pages/AdminPage.tsx`

Each page consumes context-provided state and actions and renders cards and controls.

#### 5.1.4 Shared UI
- `Header.tsx`
- `BottomNav.tsx`
- `AdminDashboard.tsx`
- Feature cards for predictions, standings, leaderboards, and group selection

### 5.2 Hooks and Business Logic

#### 5.2.1 `useUserSystem.ts`
- Auth state management
- Login and logout flows
- Group membership handling
- Profile updates

#### 5.2.2 `useMatchSystem.ts`
- Holds match schedule and results
- Accepts and stores user predictions
- Determines prediction eligibility and result status

#### 5.2.3 `useGroupSystem.ts`
- Creates and joins groups
- Switches active group context
- Lists available groups

#### 5.2.4 `useLeaderboard.ts`
- Computes rankings by group
- Aggregates points and tiebreakers
- Supports leaderboard display data

#### 5.2.5 `useSyncSystem.ts`
- Polls external match data APIs
- Updates Supabase and local state with results
- Manages sync status and notifications

#### 5.2.6 `useBackgroundSync.ts`
- Provides periodic refresh behavior for the app
- Coordinates sync intervals and manual refresh

#### 5.2.7 `usePointsProcessor.ts`
- Contains scoring rules and point calculations
- Compares predictions with actual match outcomes
- Provides utility scoring functions

### 5.3 External Integrations

#### 5.3.1 Supabase
- Auth
- PostgreSQL data storage
- Realtime subscriptions
- Configurable schema via `VITE_SUPABASE_SCHEMA`

#### 5.3.2 Football Data API
- External match schedule and results
- Accessed through Vite proxy to avoid CORS
- Sync logic must never call the Football Data API directly from browser code

#### 5.3.3 Google Gemini API
- Generates AI-assisted match predictions
- Wrapped by `services/geminiService.ts`
- Endpoint uses `api/gemini-prediction.ts`

#### 5.3.4 Google Sign-In
- Loaded from CDN in `index.html`
- Provides external authentication flow

### 5.4 UI / UX Behavior

- Users select a group and enter match predictions before kickoff
- Predictions are locked once a match begins
- Leaderboard shows points and relative ranking within the selected group
- Tournament pages show classifications and knockout predictions
- Admin dashboard exposes manual sync and state refresh controls

## 6. Constraints and Assumptions

### 6.1 Known Constraints

- Background sync currently depends on an open admin browser tab (`useSyncSystem` uses `setInterval`)
- A 24/7 sync service should be implemented as a Supabase Edge Function with `pg_cron`
- `VITE_SUPABASE_SCHEMA` is required to isolate development and production data
- `teams.code` is not globally unique; teams must be managed by `externalTeamId`
- `matches.competitionCode` FK is deferrable, so competition inserts must happen before or during match upserts

### 6.2 Nonfunctional Requirements

- Responsive UI for web devices
- Fast page render and route transitions
- Robust error handling for API calls and auth failures
- Secure handling of auth tokens and external API keys
- Maintainable code separation between UI and state logic

## 7. Deployment

### 7.1 Build and Run

- `npm install`
- `npm run dev` to run locally
- `npm run build` to generate production bundle
- `npm run preview` to preview production build

### 7.2 Environment Variables

Use `.env.example` as a guide. Required variables typically include:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_SCHEMA`
- `VITE_FOOTBALL_DATA_API_KEY`
- `GEMINI_API_KEY`

### 7.3 Deployment Notes

- Ensure Supabase schema isolation for dev/prod environments
- Deploy frontend to a static hosting platform that supports Vite apps
- Keep API keys and Supabase secrets secure in environment configuration

## 8. Appendices

### 8.1 Relevant Files and Directories

- `App.tsx`
- `contexts/DatabaseContext.tsx`
- `hooks/`
- `components/`
- `api/`
- `services/`
- `data/`
- `database/migrations/`
- `types.ts`
- `constants.ts`

### 8.2 Future Improvements

- Move background sync to Supabase Edge Functions + `pg_cron`
- Add full production-grade testing and CI pipeline
- Improve offline support and caching
- Expand AI prediction flows with user prompts and better explanations
