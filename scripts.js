const AWS_ACCESS_KEY_ID = "";
const AWS_SECRET_ACCESS_KEY_ID = "";
const AWS_REGION = "us-east-1";
const AWS_RESOURCE_REGION = "US East (N. Virginia)";

var pricing = new AWS.Pricing(
  {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY_ID,
    region: AWS_REGION
  }
);

$(document).ready(function() {

  availableEC2Instances.forEach(function(item) {
      $('#instanceType').append(new Option(item, item));
  });

  $("#btnCalculate").click(function() {
      Promise.all([
        getEC2UnitPrice($("#instanceType").val()),
        getRDSUnitPrice("db."+ $("#instanceType").val())])
      .then(function(results) {
          calculateValues(results[0], results[1])
      });
  });
});


var calculateValues = function(ec2UnitPricePerHour, rdsUnitPricePerHour) {
  var ec2perMonth = ec2UnitPricePerHour * 24 * 31;
  var rdsPerMonth = rdsUnitPricePerHour * 24 * 31;
  var serverCount = $("#serverCount").val();
  var msSetupFee = $("#setupFee").val();

  var msServerPrice = 6500;
  for (var i=1; i <= serverCount; i++) {
    if (i<=5) continue;
    if (i>=6 && i<=10) msServerPrice+=500;
    if (i>=11 && i<=20) msServerPrice+=400;
    if (i>=21 && i<=30) msServerPrice+=350;
  }

  var totalMsPerMonth = msServerPrice + ec2perMonth*serverCount;
  var totalRdsPerMonth = rdsPerMonth*serverCount;

  $("#msPriceMonthly").val(totalMsPerMonth);
  $("#awsPriceMonthly").val(totalRdsPerMonth);
}

var getRDSUnitPrice = function(instanceType)
{
   var params = {
     Filters: [
       { Field: "databaseEngine", Type: "TERM_MATCH", Value: "MySQL" },
       { Field: "instanceType", Type: "TERM_MATCH", Value: instanceType },
       { Field: "deploymentOption", Type: "TERM_MATCH", Value: "Single-AZ"},
       { Field: "location",    Type: "TERM_MATCH", Value: AWS_RESOURCE_REGION }
     ],
     FormatVersion: "aws_v1",
     ServiceCode: "AmazonRDS",
     MaxResults: 10
    };

   return getAWSPrice(params)
}

var getEC2UnitPrice = function(instanceType) {
  var params = {
    Filters: [
      { Field: "operatingSystem", Type: "TERM_MATCH", Value: "Linux" },
      { Field: "operation",       Type: "TERM_MATCH", Value: "RunInstances" },
      { Field: "capacitystatus",  Type: "TERM_MATCH", Value: "Used" },
      { Field: "tenancy",         Type: "TERM_MATCH", Value: "Shared" },
      { Field: "instanceType",    Type: "TERM_MATCH", Value: instanceType },
      { Field: "location",    Type: "TERM_MATCH", Value: AWS_RESOURCE_REGION }
    ],
    FormatVersion: "aws_v1",
    ServiceCode: "AmazonEC2",
    MaxResults: 10
   };

   return getAWSPrice(params);
}

var getAWSPrice = async function(params) {
  return pricing.getProducts(params).promise().then(function(result) {
    return getFirstOnDemandPriceHelper(result);
  });
}

var getFirstOnDemandPriceHelper = function (apiObject) {
  if (apiObject.PriceList.length != 1) { //check if api returned only single price
    throw "Pricelist returned zero or more than one price item";
  }
  var priceList = apiObject.PriceList[0].terms.OnDemand;
  var priceListKey = Object.keys(priceList)[0];
  var term = priceList[priceListKey];

  var priceDimensionKey = Object.keys(term.priceDimensions)[0];
  var priceDimension = term.priceDimensions[priceDimensionKey];
  var unitPrice = priceDimension.pricePerUnit.USD;

  return unitPrice;
}
