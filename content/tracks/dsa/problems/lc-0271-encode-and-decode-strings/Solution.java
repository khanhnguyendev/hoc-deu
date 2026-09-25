import java.util.*;

class Codec {
    public String encode(List<String> strs) {
        // Each string becomes "<length>#<string>": the length says where it ends, so the string
        // itself may contain '#' or digits.
        StringBuilder encoded = new StringBuilder();
        for (String str : strs) {
            encoded.append(str.length()).append('#').append(str);
        }
        return encoded.toString();
    }

    public List<String> decode(String s) {
        List<String> result = new ArrayList<>();
        int i = 0;
        while (i < s.length()) {
            int j = s.indexOf('#', i); // the first '#' from i closes the length prefix
            int length = Integer.parseInt(s.substring(i, j));
            result.add(s.substring(j + 1, j + 1 + length));
            i = j + 1 + length;
        }
        return result;
    }
}
