#!/usr/bin/env bash
set -euo pipefail

# Release automation script for CoachLM
# Usage: ./scripts/release.sh [patch|minor|major] [--dry-run]
#
# This script:
# 1. Validates working tree is clean
# 2. Bumps version in package.json and src-tauri/tauri.conf.json
# 3. Creates a git commit and tag
# 4. Does NOT push (manual push required)

DRY_RUN=false

# Parse arguments
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 [patch|minor|major] [--dry-run]"
  echo ""
  echo "Examples:"
  echo "  $0 patch          # Bump 1.22.0 → 1.22.1"
  echo "  $0 minor          # Bump 1.22.0 → 1.23.0"
  echo "  $0 major          # Bump 1.22.0 → 2.0.0"
  echo "  $0 patch --dry-run # Preview without changes"
  exit 1
fi

BUMP_TYPE="$1"

if [[ "${2:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

# Validate bump type
if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Error: Bump type must be one of: patch, minor, major"
  echo "Got: $BUMP_TYPE"
  exit 1
fi

# Validate we're in the repo root
if [[ ! -f package.json ]] || [[ ! -f src-tauri/tauri.conf.json ]]; then
  echo "Error: Must run from project root (missing package.json or tauri.conf.json)"
  exit 1
fi

# Check for uncommitted changes
if ! git diff --quiet HEAD; then
  echo "Error: Working tree has uncommitted changes"
  echo "Please commit or stash changes before running this script"
  git status
  exit 1
fi

if ! git diff --cached --quiet; then
  echo "Error: Staged changes detected"
  echo "Please commit or unstage changes before running this script"
  git status
  exit 1
fi

# Check if we're on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Warning: You are on branch '$CURRENT_BRANCH', not 'main'"
  read -p "Continue? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Read current version from package.json using sed/grep (no jq dependency)
CURRENT_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')

if [[ -z "$CURRENT_VERSION" ]]; then
  echo "Error: Could not read version from package.json"
  exit 1
fi

echo "Current version: $CURRENT_VERSION"

# Parse version into major.minor.patch
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Compute next version based on bump type
case "$BUMP_TYPE" in
  patch)
    PATCH=$((PATCH + 1))
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
esac

NEXT_VERSION="$MAJOR.$MINOR.$PATCH"
TAG_NAME="v$NEXT_VERSION"

echo "Next version:    $NEXT_VERSION"
echo "Tag:             $TAG_NAME"
echo ""

if [[ "$DRY_RUN" == true ]]; then
  echo "DRY RUN MODE - No changes will be made"
  echo ""
  echo "Changes that WOULD be made:"
  echo "  1. Update package.json: \"version\": \"$CURRENT_VERSION\" → \"$NEXT_VERSION\""
  echo "  2. Update src-tauri/tauri.conf.json: \"version\": \"$CURRENT_VERSION\" → \"$NEXT_VERSION\""
  echo "  3. git add package.json src-tauri/tauri.conf.json"
  echo "  4. git commit -m \"chore: release $TAG_NAME\""
  echo "  5. git tag $TAG_NAME"
  echo ""
  echo "After running without --dry-run, run:"
  echo "  git push origin main"
  echo "  git push origin $TAG_NAME"
  exit 0
fi

echo "Updating versions..."

if ! sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEXT_VERSION\"/" package.json; then
  echo "Error: Failed to update package.json"
  exit 1
fi

if ! sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEXT_VERSION\"/" src-tauri/tauri.conf.json; then
  echo "Error: Failed to update src-tauri/tauri.conf.json"
  sed -i "s/\"version\": \"$NEXT_VERSION\"/\"version\": \"$CURRENT_VERSION\"/" package.json
  exit 1
fi

echo "✓ Updated package.json"
echo "✓ Updated src-tauri/tauri.conf.json"

git add package.json src-tauri/tauri.conf.json

git commit -m "chore: release $TAG_NAME"
echo "✓ Created commit: chore: release $TAG_NAME"

git tag "$TAG_NAME"
echo "✓ Created tag: $TAG_NAME"

echo ""
echo "Release prepared successfully!"
echo ""
echo "Next steps:"
echo "  git push origin main"
echo "  git push origin $TAG_NAME"
echo ""
echo "Or push both at once:"
echo "  git push origin main --follow-tags"
