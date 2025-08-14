#!/bin/bash
set -e

# Get the version from package.json
VERSION=$(node -p "require('./package.json').version")

# Check if the tag already exists
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
    echo "Tag v$VERSION already exists. Please update the version in package.json first."
    exit 1
fi

# Create and push the tag
echo "Creating tag v$VERSION..."
git tag -a "v$VERSION" -m "Release v$VERSION"

echo "Pushing tag v$VERSION to origin..."
git push origin "v$VERSION"

echo "Successfully created and pushed tag v$VERSION"