
data "aws_region" "current" {}

locals {
  invoke_arn = "arn:aws:apigateway:${data.aws_region.current.region}:lambda:path/2015-03-31/functions/${var.function_arn}/invocations"

  authorizer_invoke_arn = "arn:aws:apigateway:${data.aws_region.current.region}:lambda:path/2015-03-31/functions/${aws_lambda_function.jwt_authorizer.arn}/invocations"
}

# Package the JWT authorizer code.
data "archive_file" "jwt_authorizer_zip" {
  type        = "zip"
  source_file = "${path.root}/../../../lambdas/jwt-authorizer/lambda_function.py"
  output_path = "${path.root}/../../../lambdas/jwt-authorizer/lambda_function.zip"
}

# Execution role for the JWT authorizer.
data "aws_iam_policy_document" "authorizer_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "authorizer" {
  name               = "${var.api_name}-jwt-authorizer-role"
  assume_role_policy = data.aws_iam_policy_document.authorizer_assume_role.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "authorizer_basic_execution" {
  role       = aws_iam_role.authorizer.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# The authorizer can read only the configured JWT secret.
data "aws_iam_policy_document" "authorizer_secret_access" {
  statement {
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.jwt_secret_arn]
  }
}

resource "aws_iam_role_policy" "authorizer_secret_access" {
  name   = "${var.api_name}-jwt-secret-access"
  role   = aws_iam_role.authorizer.id
  policy = data.aws_iam_policy_document.authorizer_secret_access.json
}

resource "aws_lambda_function" "jwt_authorizer" {
  function_name    = "${var.api_name}-jwt-authorizer"
  role             = aws_iam_role.authorizer.arn
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  filename         = data.archive_file.jwt_authorizer_zip.output_path
  source_code_hash = data.archive_file.jwt_authorizer_zip.output_base64sha256
  timeout          = 10

  environment {
    variables = {
      JWT_SECRET_ARN = var.jwt_secret_arn
    }
  }

  tags = var.tags

  depends_on = [
    aws_iam_role_policy_attachment.authorizer_basic_execution,
    aws_iam_role_policy.authorizer_secret_access
  ]
}

resource "aws_apigatewayv2_api" "this" {
  name          = var.api_name
  protocol_type = "HTTP"
  tags          = var.tags

  cors_configuration {
    allow_origins = var.allowed_origins
    allow_methods = ["POST", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = local.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id                            = aws_apigatewayv2_api.this.id
  name                              = "${var.api_name}-jwt-authorizer"
  authorizer_type                   = "REQUEST"
  authorizer_uri                    = local.authorizer_invoke_arn
  authorizer_payload_format_version = "2.0"
  enable_simple_responses           = true
  identity_sources                  = ["$request.header.Authorization"]
  authorizer_result_ttl_in_seconds  = 0
}

resource "aws_lambda_permission" "authorizer_apigw" {
  statement_id  = "AllowApiGatewayJwtAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.jwt_authorizer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/authorizers/${aws_apigatewayv2_authorizer.jwt.id}"
}

resource "aws_apigatewayv2_route" "this" {
  api_id    = aws_apigatewayv2_api.this.id
  route_key = var.route_key
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"

  authorization_type = var.auth_type
  authorizer_id      = var.auth_type == "CUSTOM" ? aws_apigatewayv2_authorizer.jwt.id : null
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true
  tags        = var.tags

  default_route_settings {
    throttling_rate_limit  = var.throttle_rate_limit
    throttling_burst_limit = var.throttle_burst_limit
  }
}

# Allow API Gateway to invoke the existing upload Lambda.
resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowHttpApiInvoke-${aws_apigatewayv2_api.this.id}"
  action        = "lambda:InvokeFunction"
  function_name = var.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}
