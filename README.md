# Race Edge BOAT free collector

GitHub Actions + GitHub Pages collector for Race Edge BOAT.

## Setup
1. Create a public GitHub repository, e.g. `raceedge-boat-feed`.
2. Upload the contents of this `github_collector` folder to the repository root.
3. Repository Settings > Pages > Source: GitHub Actions.
4. Open Actions > Race Edge collect > Run workflow once.
5. Feed URL becomes:
   `https://<GITHUB_USER>.github.io/<REPO>/raceedge-feed.json`
6. In Race Edge Ver.2.2 FREE, press `GitHub Pagesフィード設定` and enter the GitHub user/repository.

The workflow runs every 30 minutes during 00:00-14:59 UTC (09:00-23:59 JST).
Current collector automatically publishes confirmed race results. The common feed already has slots for entries, exhibition and odds, which can be added without changing the Race Edge PWA schema.
