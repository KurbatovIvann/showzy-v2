#!/usr/bin/env bash
# Append this job's wall-clock duration to the GitHub Actions job summary.
# Never changes the job conclusion (SHO-334 timing evidence).
set -euo pipefail

end="$(date +%s)"
start="${JOB_START_EPOCH:-$end}"
dur="$((end - start))"
job="${GITHUB_JOB:-unknown}"
result="${JOB_RESULT:-unknown}"
summary_file="${GITHUB_STEP_SUMMARY:-}"

body="$(
  cat <<EOF
## ${job} timing

| Field | Value |
| --- | --- |
| Result | ${result} |
| Duration seconds | ${dur} |
EOF
)"

if [[ -n "${summary_file}" ]]; then
  printf '%s\n' "${body}" >> "${summary_file}"
else
  printf '%s\n' "${body}"
fi

echo "Job ${job} finished in ${dur}s with ${result}"
