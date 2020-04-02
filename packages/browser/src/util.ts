export const stripZeroXString = (str: string): string => {
    if (str.startsWith("0x")) return str.substr(2);
    return str;
};
