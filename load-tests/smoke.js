import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://edureachhub.netlify.app';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const response = http.get(BASE_URL);

  check(response, {
    'EduReach homepage returns 200': (r) => r.status === 200,
    'homepage contains content': (r) => r.body && r.body.length > 0,
  });

  sleep(1);
}
