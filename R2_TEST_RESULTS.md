# R2: AWS / Bedrock Access Test

- AWS credentials: Passed (`aws sts get-caller-identity`)
- Region: `us-east-1`
- Model/inference profile: `us.anthropic.claude-sonnet-4-6`
- Request: `Reply with only: hello`
- Response: `hello`
- Measured latency: `2271 ms` (single request)
- Test method: Python `boto3` Bedrock Runtime `converse` API
- Result: Passed

No AWS credentials or secrets are stored in this file.
