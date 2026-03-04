import dayjs from "dayjs";
import type { OpUnitType } from "dayjs";
import duration from "dayjs/plugin/duration";
dayjs.extend(duration);
export const useDayJs = () => {
  const getTimeDifferenceBetweenTwoDates = (
    futureDate: string,
    pastDate: string,
    format: OpUnitType = "second",
  ) => {
    const targetDate = dayjs(futureDate);
    // Calculate the difference in seconds
    return targetDate.diff(pastDate, format);
  };

  const getDayJSDurationObjFromSeconds = (seconds: number) => {
    /* if (!seconds || seconds === 0) {
          return 0;
        } */
    // Create a duration object from the seconds
    return dayjs.duration(seconds, "seconds");
  };

  const generateFutureDateForNMinutes = (minute = 2) => {
    // Get the current date and time
    const currentDate = new Date();

    // Add 2 minutes (120,000 milliseconds) to the current time
    const futureDate = new Date(currentDate.getTime() + minute * 60 * 1000);

    // Format the date to ISO 8601 with microseconds and UTC offset
    const isoString = futureDate.toISOString(); // e.g., "2025-03-29T13:14:24.839Z"
    const microseconds = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0"); // Random microseconds
    return isoString.replace("Z", `${microseconds}+00:00`);
  };

  return {
    getTimeDifferenceBetweenTwoDates,
    getDayJSDurationObjFromSeconds,
    generateFutureDateForNMinutes,
  };
};
