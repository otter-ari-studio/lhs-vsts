ADD . /home/

RUN chmod +x /home/docker/start.sh
RUN cd /home/ && npm install && npm run build

ENTRYPOINT /usr/sbin/sshd && /usr/sbin/crond && /home/docker/start.sh && sleep 9999999d
