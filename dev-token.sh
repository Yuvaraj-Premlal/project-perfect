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
echo "Ready. API=$API"
