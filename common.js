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

function categorizeRestaurant(type) {
  if (type.includes("육류") || type.includes("고기") || type.includes("한식")) {
    return "한식";
  } else if (
    type.includes("초밥") ||
    type.includes("일식") ||
    type.includes("오마카세")
  ) {
    return "일식";
  } else if (type.includes("중식")) {
    return "중식";
  } else if (
    type.includes("떡볶이") ||
    type.includes("김밥") ||
    type.includes("분식")
  ) {
    return "분식";
  } else if (
    type.includes("피자") ||
    type.includes("햄버거") ||
    type.includes("브런치") ||
    type.includes("양식")
  ) {
    return "양식";
  } else if (
    type.includes("카페") ||
    type.includes("디저트") ||
    type.includes("베이커리")
  ) {
    return "카페/디저트";
  } else if (
    type.includes("생선") ||
    type.includes("해물") ||
    type.includes("장어") ||
    type.includes("매운탕")
  ) {
    return "해물/생선 요리";
  } else if (type.includes("치킨") || type.includes("닭강정")) {
    return "치킨";
  } else if (type.includes("양꼬치")) {
    return "양꼬치/중화";
  } else {
    return "기타";
  }
}

module.exports = { searchBusiness, categorizeRestaurant };
