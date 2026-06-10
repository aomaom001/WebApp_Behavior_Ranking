# Team Behavior Ranking Dashboard — static site served by nginx.
# Build context = this folder (frontend/).
#   docker build -t ww-tt-dashboard frontend
FROM nginx:1.27-alpine

# site config: gzip for the large JSON, sane caching, utf-8
COPY nginx.conf /etc/nginx/conf.d/default.conf

# copy only the runtime assets (no pipeline scripts, no Excel exports, no backups)
COPY index.html /usr/share/nginx/html/index.html
COPY css/  /usr/share/nginx/html/css/
COPY js/   /usr/share/nginx/html/js/
COPY data/ /usr/share/nginx/html/data/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
