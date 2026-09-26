ADD . /home/

RUN chmod +x /home/docker/start.sh
RUN cd /home/ && corepack enable && pnpm install && pnpm run build:docker

ENTRYPOINT /usr/sbin/sshd && /usr/sbin/crond && /home/docker/start.sh && sleep 9999999d
