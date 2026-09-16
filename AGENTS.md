## No Comments
- Code should be self-explanatory. Comments should be avoided as much as possible.
- Write clear, descriptive variable and function names
- Structure code so its intent is obvious
- Only add comments if absolutely required (e.g., explaining a non-obvious workaround or complex algorithm that cannot be simplified)

## Git Workflow
- Keep `main` stable and deployable
- For each meaningful feature, fix, or change, create a GitHub issue and a dedicated branch before making changes
- Use clear, descriptive branch names (e.g., `feature/gm-simulation`, `fix/count-rate`)
- Keep commits small, logical, and focused on the current issue
- Create a pull request when the work is complete and verify the changes before merging
- Merge completed pull requests into `main` and clean up the branch afterward
- Do not create issues, branches, or pull requests for trivial changes
- Handle the Git workflow autonomously without asking for confirmation at each step