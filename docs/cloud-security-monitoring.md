# HomeTrust Cloud C — Security and Monitoring

## Sprint 1: S1-C1

**Story:** Secrets/environment setup, CloudWatch logging, and least-privilege IAM roles.

### 1. AWS Secrets Manager

- **Secret name:** `capstone-app-dev/jwt-secret`
- **Environment variable:** `JWT_SECRET`
- **Purpose:** Secure storage of the application's JWT signing secret.
- **Status:** Secret created in AWS Secrets Manager.
- **IAM permission:** The application role has `secretsmanager:GetSecretValue` permission scoped to the secret.
- **Outstanding:** Backend integration is not yet confirmed. The Express backend currently reads `process.env.JWT_SECRET` and has a hardcoded fallback of `'secret'`. The backend team needs to make the secret available securely at runtime and remove the fallback.

### 2. Least-Privilege IAM

**Application role:** `capstone-app-dev-api-role`

- Reviewed the existing inline IAM policy.
- CloudWatch Logs permissions are scoped to the application log group.
- DynamoDB permissions are scoped to the configured application table.
- Secrets Manager access is scoped to the JWT secret.
- The role's trust policy allows the AWS Lambda service to assume the role.

**Status:** Existing IAM permissions and resource scopes reviewed.

### 3. CloudWatch Logging

**Verified Lambda:** `hometrust-presigned-upload`

- Confirmed that Lambda execution logs are recorded in CloudWatch.
- Observed `START`, `END`, and `REPORT` events from successful executions.
- The execution records include duration and memory usage.

**Outstanding:** Confirm the active Express backend deployment and verify its logging configuration. The `capstone-app-dev-api` function was not visible in the Lambda console during inspection, although its IAM role and CloudWatch log group exist.

### 4. Outstanding Sprint 1 Actions

1. Confirm the active backend deployment with the Backend and Cloud A team members.
2. Coordinate secure `JWT_SECRET` runtime integration with the Backend team.
3. Verify backend logging once the active deployment is confirmed.
4. Update this document with the results of the outstanding checks.

### Security Note

Never commit secret values, passwords, AWS access keys, JWTs, or complete presigned URLs to GitHub.
