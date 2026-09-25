// content-verify Java runner: serialises a solution's result as JSON (platform design §3.7).
// Copied next to the generated Main.java for every problem; standard library only.

import java.lang.reflect.Array;

final class Json {
    private Json() {
    }

    /**
     * null, String, Character (a one-character string), Boolean, boxed numbers (NaN and the
     * infinities have no JSON form: null), arrays of any type (reflection) and any Iterable.
     * The output is pure ASCII: every other character becomes a JSON unicode escape.
     */
    static String write(Object value) {
        StringBuilder out = new StringBuilder();
        append(out, value);
        return out.toString();
    }

    private static void append(StringBuilder out, Object value) {
        if (value == null) {
            out.append("null");
        } else if (value instanceof String text) {
            string(out, text);
        } else if (value instanceof Character character) {
            string(out, String.valueOf(character));
        } else if (value instanceof Boolean bool) {
            out.append(bool.booleanValue());
        } else if (value instanceof Double || value instanceof Float) {
            double number = ((Number) value).doubleValue();
            out.append(Double.isNaN(number) || Double.isInfinite(number) ? "null" : Double.toString(number));
        } else if (value instanceof Number number) {
            out.append(number.toString());
        } else if (value.getClass().isArray()) {
            out.append('[');
            int length = Array.getLength(value);
            for (int index = 0; index < length; index++) {
                if (index > 0) {
                    out.append(',');
                }
                append(out, Array.get(value, index));
            }
            out.append(']');
        } else if (value instanceof Iterable<?> items) {
            out.append('[');
            boolean first = true;
            for (Object item : items) {
                if (!first) {
                    out.append(',');
                }
                first = false;
                append(out, item);
            }
            out.append(']');
        } else {
            throw new IllegalArgumentException("content-verify cannot serialise a " + value.getClass().getName());
        }
    }

    private static void string(StringBuilder out, String text) {
        out.append('"');
        for (int index = 0; index < text.length(); index++) {
            char c = text.charAt(index);
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20 || c > 0x7e) {
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        out.append('"');
    }
}
