# Changelog

All notable changes to FiskAI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Recovery Phase (2026-02-01)

#### Added

- ROADMAP.md - Development roadmap and milestones
- CHANGELOG.md - Version history tracking
- DECISIONS.md - Architecture decision records
- AGENTS.md - AI agent guidelines and conventions

## [2026-02-01] - i18n & Fixes

### Added

- Croatian translations for Control Center (#1509)
- Registration intent system with Obrt/Društvo branching (#1497)
- Onboarding draft persistence in User model (#1498)

### Fixed

- Type exports moved out of "use server" files (#1507, #1508)
- Prisma module resolution in Docker (#1506)
- Prisma datasource URL property (#1505)
- Docker entrypoint Prisma migrate (#1499-#1504)

## [2026-01-22] - 3-Repo Architecture

### Changed

- Finalized 3-repo architecture split (#1496)
  - **FiskAI-App**: Next.js application
  - **fiskai-intelligence**: Intelligence API + workers
  - **fiskai-marketing**: Marketing site
- Archived fiskai-workers repo

### Removed

- Regulatory intelligence code (moved to fiskai-intelligence)
- Workers code (moved to fiskai-intelligence)

## [1.2.0] - 2024-12-29

### Added

- In-app changelog and feature announcements system
- "What's New" modal to discover latest features on login
- Dismiss functionality with localStorage persistence

### Changed

- Improved dashboard loading performance

## [1.1.0] - 2024-12-15

### Added

- AI Assistant v2 with improved reasoning display
- Evidence panel for regulatory answers
- Personalization settings for assistant

### Fixed

- Mobile navigation responsiveness issues

## [1.0.0] - 2024-12-01

### Added

- Initial release of FiskAI platform
- Dashboard with compliance status
- Invoice management
- Fiscalization integration
- Contact management
- Product catalog
- Expense tracking
- Banking integration
- Reports (basic and advanced)
- Pausalni obrt support
- VAT management
- Corporate tax module
- POS system
- Document management
- AI-powered assistant

## Earlier History

For changes prior to 2024-12-01, please refer to the git log:

```bash
git log --oneline --before="2024-12-01"
```
