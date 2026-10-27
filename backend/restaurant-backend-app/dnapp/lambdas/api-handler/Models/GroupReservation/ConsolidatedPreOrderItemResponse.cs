using System.Text.Json.Serialization;

namespace APIHandler.Models.GroupReservation;

public record ConsolidatedPreOrderItemResponse(
    [property: JsonPropertyName("dishId")] string DishId,
    [property: JsonPropertyName("quantity")] int Quantity);
