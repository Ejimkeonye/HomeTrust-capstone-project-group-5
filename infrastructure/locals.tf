locals {
  name          = "${var.project}-${var.environment}"
  bucket_name   = "${local.name}-site-${data.aws_caller_identity.current.account_id}"
  lambda_name   = "${local.name}-api"
  lambda_origin = trimsuffix(replace(aws_lambda_function_url.api.function_url, "https://", ""), "/")
}