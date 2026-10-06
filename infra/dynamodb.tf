resource "aws_dynamodb_table" "properties" {
  name         = "${var.project}-${var.environment}-properties"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "propertyId"

  attribute {
    name = "propertyId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "inspections" {
  name         = "${var.project}-${var.environment}-inspections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "inspectionId"

  attribute {
    name = "inspectionId"
    type = "S"
  }

  attribute {
    name = "propertyId"
    type = "S"
  }

  global_secondary_index {
    name            = "byProperty"
    hash_key        = "propertyId"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.environment != "dev"
  }
}

resource "aws_dynamodb_table" "parties" {
  name         = "${var.project}-${var.environment}-parties"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "inspectionId"
  range_key    = "partyId"

  attribute {
    name = "inspectionId"
    type = "S"
  }
  attribute {
    name = "partyId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "room_items" {
  name         = "${var.project}-${var.environment}-roomItems"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "inspectionId"
  range_key    = "roomItemId"

  attribute {
    name = "inspectionId"
    type = "S"
  }
  attribute {
    name = "roomItemId"
    type = "S"
  }
}

output "properties_table_name" {
  value = aws_dynamodb_table.properties.name
}
output "inspections_table_name" {
  value = aws_dynamodb_table.inspections.name
}
output "parties_table_name" {
  value = aws_dynamodb_table.parties.name
}
output "room_items_table_name" {
  value = aws_dynamodb_table.room_items.name
}
