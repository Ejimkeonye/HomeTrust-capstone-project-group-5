# tflint-ignore: terraform_unused_declarations
variable "environment" {
  type = string
}

# tflint-ignore: terraform_unused_declarations
variable "cors_allowed_origins" {
  type    = list(string)
  default = ["https://hometrust-6ecy.onrender.com"] # replace with Production site URL only
}

# tflint-ignore: terraform_unused_declarations
variable "api_auth_type" {
  type    = string
  default = "AWS_IAM" # replace with your desired auth type for production
}