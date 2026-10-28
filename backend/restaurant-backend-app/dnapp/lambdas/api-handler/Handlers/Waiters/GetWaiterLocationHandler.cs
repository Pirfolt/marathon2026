using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.Core;
using APIHandler.Helpers;
using APIHandler.Services.Waiters;
using System;
using System.Threading.Tasks;

namespace APIHandler.Handlers.Waiters;

public class GetWaiterLocationHandler : IApiRequestHandler
{
    private readonly IWaiterService _waiterService;

    public GetWaiterLocationHandler(IWaiterService waiterService)
    {
        _waiterService = waiterService ?? throw new ArgumentNullException(nameof(waiterService));
    }

    public async Task<APIGatewayProxyResponse> HandleRequest(APIGatewayProxyRequest request, ILambdaContext context)
    {
        if (!request.PathParameters.TryGetValue("userId", out var waiterId) || string.IsNullOrEmpty(waiterId))
        {
            return ResponseBuilder.CreateErrorResponse(400, "Missing or invalid waiterId in path parameters", context.Logger);
        }

        var locationIds = await _waiterService.GetWaiterLocationIdsAsync(waiterId);

        if (locationIds == null || locationIds.Count == 0)
        {
            return ResponseBuilder.CreateErrorResponse(404, $"No location found for waiter with ID {waiterId}", context.Logger);
        }

        return ResponseBuilder.CreateSuccessResponse(new
        {
            locationId = locationIds[0],
            locationIds,
        });
    }
}
