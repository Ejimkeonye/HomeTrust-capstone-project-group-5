output "api_endpoint" {
  description = "Base URL of the HTTP API"
  value       = aws_apigatewayv2_api.this.api_endpoint
}

output "route_url" {
  description = "Full URL for the route (assumes a path in route_key)"
  value       = "${aws_apigatewayv2_api.this.api_endpoint}${split(" ", var.route_key)[1]}"
}

output "api_id" {
  value = aws_apigatewayv2_api.this.id
}