
resource "aws_iam_user" "abcd" {
  for_each = var.iam_users
  name     = each.key
  path     = "/${var.project}/"
}

# --- Profile: Platform & Delivery -------------------------------------------------------
data "aws_iam_policy_document" "deployer" {
  statement {
    sid       = "ListSiteBucket"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.site.arn]
  }

  statement {
    sid       = "WriteSiteObjects"
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
  }

  statement {
    sid       = "InvalidateCache"
    actions   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
    resources = [aws_cloudfront_distribution.this.arn]
  }
}

# --- Profile: Core data ---------------------------------------------------
data "aws_iam_policy_document" "api_debugger" {
  statement {
    sid       = "ReadLambdaConfig"
    actions   = ["lambda:GetFunctionConfiguration"]
    resources = [aws_lambda_function.api.arn]
  }

  statement {
    sid       = "ReadLambdaLogs"
    actions   = ["logs:DescribeLogStreams", "logs:GetLogEvents", "logs:FilterLogEvents"]
    resources = [aws_cloudwatch_log_group.lambda.arn, "${aws_cloudwatch_log_group.lambda.arn}:*"]
  }
}

# --- Profile: Reliability, Security & Cost ----------------------------------------------------
data "aws_iam_policy_document" "data_reader" {
  statement {
    sid       = "ReadItemsTable"
    actions   = ["dynamodb:DescribeTable", "dynamodb:GetItem", "dynamodb:Query"]
    resources = [aws_dynamodb_table.items.arn]
  }
}

# --- Profile: Media, Uploads & Reporting --------------------------------------------------------
data "aws_iam_policy_document" "monitor" {
  statement {
    sid       = "ReadProjectAlarms"
    actions   = ["cloudwatch:DescribeAlarms", "cloudwatch:DescribeAlarmHistory"]
    resources = ["arn:aws:cloudwatch:${var.region}:${data.aws_caller_identity.current.account_id}:alarm:${local.name}-*"]
  }

  statement {
    sid       = "ReadMetrics"
    actions   = ["cloudwatch:GetMetricData", "cloudwatch:GetMetricStatistics", "cloudwatch:ListMetrics"]
    resources = ["*"] # CloudWatch metric read actions do not support resource-level permissions
  }

  statement {
    sid       = "InspectAlertsTopic"
    actions   = ["sns:GetTopicAttributes", "sns:ListSubscriptionsByTopic"]
    resources = [aws_sns_topic.alerts.arn]
  }
}

locals {
  iam_profile_policies = {
    deployer     = data.aws_iam_policy_document.deployer.json
    api_debugger = data.aws_iam_policy_document.api_debugger.json
    data_reader  = data.aws_iam_policy_document.data_reader.json
    monitor      = data.aws_iam_policy_document.monitor.json
  }
}

resource "aws_iam_policy" "profile" {
  for_each = local.iam_profile_policies
  name     = "${local.name}-${each.key}"
  policy   = each.value
}

resource "aws_iam_user_policy_attachment" "profile" {
  for_each   = var.iam_users
  user       = aws_iam_user.abcd[each.key].name
  policy_arn = aws_iam_policy.profile[each.value].arn
}

# --- MFA enforcement + self-service (applies to every user) -----------------
data "aws_iam_policy_document" "self_service_mfa" {
  statement {
    sid       = "ViewPasswordPolicy"
    actions   = ["iam:GetAccountPasswordPolicy", "iam:ListVirtualMFADevices"]
    resources = ["*"]
  }

  statement {
    sid       = "ManageOwnPassword"
    actions   = ["iam:ChangePassword", "iam:GetUser", "iam:ListMFADevices"]
    resources = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:user/${var.project}/$${aws:username}"]
  }

  statement {
    sid     = "ManageOwnVirtualMfa"
    actions = ["iam:CreateVirtualMFADevice"]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:mfa/$${aws:username}",
    ]
  }

  statement {
    sid     = "EnrollOwnMfa"
    actions = ["iam:EnableMFADevice", "iam:ResyncMFADevice"]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:user/${var.project}/$${aws:username}",
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:mfa/$${aws:username}",
    ]
  }

  statement {
    sid    = "DenyEverythingElseWithoutMfa"
    effect = "Deny"
    not_actions = [
      "iam:CreateVirtualMFADevice",
      "iam:EnableMFADevice",
      "iam:GetAccountPasswordPolicy",
      "iam:GetUser",
      "iam:ListMFADevices",
      "iam:ListVirtualMFADevices",
      "iam:ResyncMFADevice",
      "iam:ChangePassword",
      "sts:GetSessionToken",
    ]
    resources = ["*"]

    condition {
      test     = "BoolIfExists"
      variable = "aws:MultiFactorAuthPresent"
      values   = ["false"]
    }
  }
}

resource "aws_iam_policy" "self_service_mfa" {
  name   = "${local.name}-self-service-mfa"
  policy = data.aws_iam_policy_document.self_service_mfa.json
}

resource "aws_iam_user_policy_attachment" "self_service_mfa" {
  for_each   = var.iam_users
  user       = aws_iam_user.abcd[each.key].name
  policy_arn = aws_iam_policy.self_service_mfa.arn
}