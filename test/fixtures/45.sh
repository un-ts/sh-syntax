#!/usr/bin/env bash
set -euo pipefail

stage_path="$(dirname "$(realpath -s "$0")")/../../globals.stage"

# git on vercel https://vercel.com/docs/concepts/deployments/build-step#build-image

# check if program does not exist https://stackoverflow.com/a/26759734
# check if in github repo https://stackoverflow.com/a/16925062
if [[ ! -x "$(command -v git)" ]] || [[ $(git rev-parse --is-inside-work-tree 2> /dev/null) != "true" ]]; then
    # check if file does not exist https://linuxize.com/post/bash-check-if-file-exists/
    if [[ ! -f "globals.stage" ]]; then
        if [[ ! -x "$(command -v git)" ]]; then
            echo '[stage]: git is not installed.' >&2
            exit 1
        else
            echo '[stage]: not a git repository.' >&2
            exit 1
        fi
    else
        stage=$(cat "globals.stage")
        # trim newlines https://stackoverflow.com/a/12973694
        # trim whitespace https://stackoverflow.com/a/13092379
        stage=$(echo "$stage" | xargs)
        echo "$stage"
        exit 0
    fi
fi

# current git branch https://stackoverflow.com/a/1593487
branch_name=$(git symbolic-ref -q HEAD)
branch_name=${branch_name##refs/heads/}
branch_name=${branch_name:-HEAD}

# bash kebab-case https://stackoverflow.com/a/56080830
branch_name=$(echo "$branch_name" \
    | sed 's/\([^A-Z]\)\([A-Z0-9]\)/\1-\2/g' \
    | sed 's/\([A-Z0-9]\)\([A-Z0-9]\)\([^A-Z]\)/\1-\2\3/g' \
    | tr '[:upper:]' '[:lower:]')

monorepo_path="$("$(dirname "$(realpath -s "$0")")/../functions/monorepo_path")"
# extract json key https://unix.stackexchange.com/questions/480481/grep-the-name-from-package-json-file#comment1308267_691616
base_branch="$(grep -o '"baseBranch"\s*:\s*"[^"]*' "$monorepo_path/turbo.json" | grep -o '[^"]*$')"
base_branch="${base_branch##*/}"

# if statement https://www.tutorialkart.com/bash-shell-scripting/bash-else-if/
if [[ "$branch_name" == "production" ]]; then
    echo '[stage]: "production" is not a valid branch name' >&2
    exit 1
fi

if [[ "$branch_name" == "$base_branch" ]]; then
    branch_name="production"
fi

# noclobber https://stackoverflow.com/a/56138414
set -o noclobber
echo "$branch_name" >| "$stage_path"

echo "$branch_name"
