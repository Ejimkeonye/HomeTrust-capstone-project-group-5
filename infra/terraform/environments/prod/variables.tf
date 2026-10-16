variable "environment" {
  type = string
}

variable "cors_allowed_origins" {
  type    = list(string)
  default = ["https://hometrust-6ecy.onrender.com"] # replace with Production site URL only
}

variable "api_auth_type" {
  type    = string
  default = "AWS_IAM" # replace with your desired auth type for production
}