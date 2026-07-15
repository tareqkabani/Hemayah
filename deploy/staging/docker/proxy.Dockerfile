# وكيل https أمام البوابة الموحّدة — انظر proxy-entrypoint.sh
FROM nginx:alpine
RUN apk add --no-cache openssl
COPY deploy/staging/docker/proxy-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 80 443
CMD ["/entrypoint.sh"]
