const axios = require("axios");

// searchBusiness 함수 정의 (본문에 제공된 코드 사용)
// async function searchBusiness() {
//   const query = "강남대학교 맛집";
//   const businessType = "restaurant";
//   const lat = 37.2718378;
//   const lon = 127.1276313;
//   const useReverseGeocode = true;
//   const page = 1;
//   const url = "https://pcmap-api.place.naver.com/graphql";

//   console.log(
//     `Searching for ${businessType} with query: ${query}, lat: ${lat}, lon: ${lon}`
//   );

//   let params;
//   params = {
//     operationName: "getRestaurants",
//     variables: {
//       input: {
//         query: query,
//         x: lon.toString(),
//         y: lat.toString(),
//         start: (page - 1) * 70 + 1,
//         display: 70,
//         deviceType: "pcmap",
//         sortingOrder: "precision",
//       },
//       isNmap: true,
//       useReverseGeocode: useReverseGeocode,
//     },
//     query: `
//         query getRestaurants($input: RestaurantListInput, $isNmap: Boolean!, $useReverseGeocode: Boolean!) {
//             restaurants: restaurantList(input: $input) {
//               total
//               items {
//                 id
//                 name
//                 category
//                 roadAddress
//                 address
//                 phone
//                 virtualPhone
//                 x
//                 y
//                 imageUrl
//                 reviewCount
//                 bookingReviewCount
//                 totalReviewCount
//                 visitorReviewCount
//                 bookingReviewScore
//                 visitorReviewScore
//                 description
//                 options
//                 businessHours
//                 microReview
//                 imageMarker @include(if: $isNmap) {
//                   marker
//                   markerSelected
//                 }
//                 markerId @include(if: $isNmap)
//                 markerLabel @include(if: $isNmap) {
//                   text
//                   style
//                 }
//               }
//             }
//             ${
//               useReverseGeocode
//                 ? `
//             reverseGeocodingAddr(input: {x: "${lon}", y: "${lat}"}) @include(if: $useReverseGeocode) {
//               rcode
//               region
//             }
//             `
//                 : ""
//             }
//           }
//       `,
//   };

//   const config = {
//     headers: {
//       "Content-Type": "application/json",
//       Referer: "https://map.naver.com/",
//     },
//   };

//   try {
//     console.log(`Sending request for ${businessType} search...`);
//     const response = await axios.post(url, params, config);
//     console.log(`Received response for ${businessType} search.`);
//     return response.data.data.restaurants;
//   } catch (error) {
//     console.error(
//       `Error in searchBusiness for ${businessType}:`,
//       error.message
//     );
//     return null;
//   }
// }


async function searchBusiness() {
  const query = "강남대학교 맛집";
  const businessType = "restaurant";
  const lat = 37.2718378;
  const lon = 127.1276313;
  const useReverseGeocode = true;
  const url = "https://pcmap-api.place.naver.com/graphql";

  console.log(
    `Searching for ${businessType} with query: ${query}, lat: ${lat}, lon: ${lon}`
  );

  let allResults = [];
  let page = 1;
  let total = 0;
  let displayCount = 70; // 한 페이지에 보여줄 데이터 개수

  const config = {
    headers: {
      "Content-Type": "application/json",
      Referer: "https://map.naver.com/",
    },
  };

  try {
    do {
      let params = {
        operationName: "getRestaurants",
        variables: {
          input: {
            query: query,
            x: lon.toString(),
            y: lat.toString(),
            start: (page - 1) * displayCount + 1,
            display: displayCount,
            deviceType: "pcmap",
            sortingOrder: "precision",
          },
          isNmap: true,
          useReverseGeocode: useReverseGeocode,
        },
        query: `
            query getRestaurants($input: RestaurantListInput, $isNmap: Boolean!, $useReverseGeocode: Boolean!) {
                restaurants: restaurantList(input: $input) {
                  total
                  items {
                    id
                    name
                    category
                    roadAddress
                    address
                    phone
                    virtualPhone
                    x
                    y
                    imageUrl
                    reviewCount
                    bookingReviewCount
                    totalReviewCount
                    visitorReviewCount
                    bookingReviewScore
                    visitorReviewScore
                    description
                    options
                    businessHours
                    microReview
                    imageMarker @include(if: $isNmap) {
                      marker
                      markerSelected
                    }
                    markerId @include(if: $isNmap)
                    markerLabel @include(if: $isNmap) {
                      text
                      style
                    }
                  }
                }
                ${
                  useReverseGeocode
                    ? `
                reverseGeocodingAddr(input: {x: "${lon}", y: "${lat}"}) @include(if: $useReverseGeocode) {
                  rcode
                  region
                }
                `
                    : ""
                }
              }
          `,
      };

      console.log(`Sending request for page ${page}...`);
      const response = await axios.post(url, params, config);
      const data = response.data.data.restaurants;

      if (data && data.items) {
        allResults = allResults.concat(data.items);
        total = data.total;
        page++;
      } else {
        break;
      }
    } while (allResults.length < total); // 총 데이터 수만큼 반복

    console.log(`Collected ${allResults.length} results.`);
    return allResults;
  } catch (error) {
    console.error(
      `Error in searchBusiness for ${businessType}:`,
      error.message
    );
    return null;
  }
}

module.exports = { searchBusiness };
