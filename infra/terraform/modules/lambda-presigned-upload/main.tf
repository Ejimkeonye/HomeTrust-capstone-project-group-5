data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.root}/../../../lambdas/presigned-upload/lambda_function.py"
  output_path = "${path.root}/../../../lambdas/presigned-upload/lambda_function.zip"
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = [
      "sts:AssumeRole"
    ]
  }
}

resource "aws_iam_role" "lambda" {
  name = "${var.function_name}-role"

  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "s3_upload" {
  statement {
    effect = "Allow"

    actions = [
      "s3:PutObject"
    ]

    resources = [
      "${var.bucket_arn}/evidence/*"
    ]
  }
}

resource "aws_iam_role_policy" "s3_upload" {
  name = "${var.function_name}-s3-upload"

  role = aws_iam_role.lambda.id

  policy = data.aws_iam_policy_document.s3_upload.json
}

resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "presigned_upload" {
  function_name = var.function_name

  role = aws_iam_role.lambda.arn

  runtime = "python3.12"
  handler = "lambda_function.lambda_handler"

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256  

  environment {
    variables = {
      BUCKET_NAME = var.bucket_name
    }
  }
}
