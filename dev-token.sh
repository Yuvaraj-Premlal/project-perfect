export API="https://project-perfect-api-hshgg9fkhvdhe2bz.centralindia-01.azurewebsites.net"
export TOKEN=$(node -e "
const jwt = require('/workspaces/project-perfect/apps/api/node_modules/jsonwebtoken');
const token = jwt.sign(
  { sub: '00000000-0000-0000-0000-000000000002', tenant_id: '00000000-0000-0000-0000-000000000001', role: 'pm', email: 'yuvaraj@testco.com' },
  'test-secret',
  { expiresIn: '24h' }
);
console.log(token);
")
export PROJECT_ID="a8cf6686-f2df-4626-bba7-a61026dde888"
export TASK_ID="469ee8e1-08ea-4b36-81fe-e624b63f76d7"
echo "Ready. API=$API | PROJECT=$PROJECT_ID"
