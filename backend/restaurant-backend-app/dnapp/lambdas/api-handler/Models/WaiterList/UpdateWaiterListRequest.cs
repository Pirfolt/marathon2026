using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace APIHandler.Models.WaiterList;

public class UpdateWaiterListRequest
{
    [JsonPropertyName("email")]
    public required string Email { get; set; }

    [JsonPropertyName("locationId")]
    public string? LocationId { get; set; }

    [JsonPropertyName("locationIds")]
    public List<string>? LocationIds { get; set; }
}